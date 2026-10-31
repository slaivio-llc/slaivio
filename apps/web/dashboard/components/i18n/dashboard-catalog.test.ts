import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {expect,it} from 'vitest';
import english from '@/messages/dashboard.en.json';

it('provides an English entry for every source-level dashboard message',()=>{
  const missing=new Set<string>();
  const catalog:Record<string,string>=english;
  function scan(directory:string){
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()){
        if(!['landing','i18n'].includes(entry.name))scan(file);
      }else if(file.endsWith('.tsx')&&!file.includes('.test.')){
        const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
        function visit(node:ts.Node){
          if(ts.isCallExpression(node)&&node.expression.getText(ast)==='dashboardText'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){
            const key=node.arguments[0].text.trim();
            if(key&&!catalog[key])missing.add(key);
          }
          ts.forEachChild(node,visit);
        }
        visit(ast);
      }
    }
  }
  scan(path.join(process.cwd(),'components'));
  expect([...missing]).toEqual([]);
});
