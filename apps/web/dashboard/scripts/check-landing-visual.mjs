/* Local-only visual check. No form submission and no private application APIs. */
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';

async function run(){
  const output=fs.mkdtempSync(path.join(os.tmpdir(),'slaivio-landing-check-'));
  const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
    '--headless','--disable-gpu','--disable-background-networking','--no-first-run',
    '--remote-debugging-port=0',`--user-data-dir=${path.join(output,'profile')}`,'about:blank',
  ],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let socket;
  try{
    const address=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Browser startup timed out')),20000);
      browser.once('error',reject);
      browser.stderr.on('data',chunk=>{const match=chunk.toString().match(/DevTools listening on (ws:\/\/\S+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
    });
    const targets=await(await fetch(`http://${new URL(address).host}/json/list`)).json();
    socket=new WebSocket(targets.find(item=>item.type==='page').webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
    let sequence=0;const pending=new Map();
    socket.onmessage=event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);if(message.error)reject(new Error(message.error.message));else resolve(message.result);}};
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
    await call('Page.enable');
    for(const [name,width,height,url] of [
      ['desktop',1440,1150,'http://127.0.0.1:3100/fr'],
      ['mobile',390,1000,'http://127.0.0.1:3100/fr'],
      ['small-mobile',320,950,'http://127.0.0.1:3100/fr'],
      ['english',390,1000,'http://127.0.0.1:3100/en'],
    ]){
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
      await call('Page.navigate',{url});
      for(let attempt=0;attempt<120;attempt++){
        const ready=await evaluate("document.readyState==='complete' && !!document.querySelector('h1')");
        if(ready)break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      await evaluate('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
      const metrics=await evaluate('({width:innerWidth,content:document.documentElement.scrollWidth,heading:document.querySelector("h1")?.textContent})');
      if(metrics.content>metrics.width)throw new Error(`${name}: horizontal overflow ${JSON.stringify(metrics)}`);
      fs.writeFileSync(path.join(output,`${name}.png`),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
      process.stdout.write(JSON.stringify({name,...metrics})+'\n');
      if(name==='desktop'){
        await evaluate('document.getElementById("plateforme").scrollIntoView()');
        fs.writeFileSync(path.join(output,'features.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
      }
      if(name==='mobile'){
        for(let attempt=0;attempt<20;attempt++){
          await evaluate('Array.from(document.querySelectorAll("button")).find(button=>button.textContent.includes("Demander une démo")&&button.getClientRects().length)?.click()');
          if(await evaluate('!!document.querySelector("[role=dialog]")'))break;
          await new Promise(resolve=>setTimeout(resolve,150));
        }
        if(!await evaluate('!!document.querySelector("[role=dialog]")'))throw new Error('Demo form did not open');
        fs.writeFileSync(path.join(output,'demo-mobile.png'),Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
        await evaluate('document.querySelector("[role=dialog] button[aria-label]")?.click()');
      }
    }
    process.stdout.write(`Captures: ${output}\n`);
    await call('Browser.close').catch(()=>{});
  }finally{socket?.close();browser.kill();}
}
run().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
