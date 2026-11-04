import { afterEach, expect, it, vi } from 'vitest';
import { api, API_BASE_URL, setAccessTokenProvider, apiErrorDetail, API_MUTATION_FAILED_EVENT,isPlanLimitError } from './api';
import {AxiosError} from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

afterEach(()=>setAccessTokenProvider(null));

it.each([
 ['pricing_grid_has_no_price_rules','Ajoutez un prix'],
 ['pricing_version_overlap','Vérifiez les dates'],
 ['invalid_pricing_transition','Actualisez sa fiche'],
])('explains pricing refusal %s in agency language',(code,expected)=>{
 const message=apiErrorDetail({isAxiosError:true,response:{status:409,data:{detail:code}}});
 expect(message).toContain(expected);
 expect(message).not.toContain(code);
});

it.each(['/organization/network/offices','/warehouses'])('leaves quota guidance inside the creation form without a duplicate failure toast: %s',async url=>{
 const listener=vi.fn();window.addEventListener(API_MUTATION_FAILED_EVENT,listener);
 const message='Votre offre inclut jusqu’à 1 entrepôt. Cette capacité est déjà utilisée.';
 const adapter=async(config:InternalAxiosRequestConfig)=>{throw new AxiosError('Request failed with status code 409','ERR_BAD_REQUEST',config,undefined,{status:409,statusText:'Conflict',headers:{},config,data:{detail:{code:'plan_limit_reached',resource:'max_warehouses',message}}});};
 try{await api.post(url,{}, {adapter});expect.fail('must retain the quota refusal');}catch(error){
  expect(isPlanLimitError(error)).toBe(true);expect(apiErrorDetail(error)).toBe(message);
  expect(listener).not.toHaveBeenCalled();
 }finally{window.removeEventListener(API_MUTATION_FAILED_EVENT,listener);}
});

it('presents other quota refusals as information, not an application failure',async()=>{
 const listener=vi.fn();window.addEventListener(API_MUTATION_FAILED_EVENT,listener);
 const adapter=async(config:InternalAxiosRequestConfig)=>{throw new AxiosError('409','ERR_BAD_REQUEST',config,undefined,{status:409,statusText:'Conflict',headers:{},config,data:{detail:{code:'plan_limit_reached',message:'Capacité atteinte.'}}});};
 try{await expect(api.post('/clients',{}, {adapter})).rejects.toThrow();
  expect(listener.mock.calls[0][0].detail).toMatchObject({tone:'info',title:'Capacité de votre offre',message:'Capacité atteinte.'});
 }finally{window.removeEventListener(API_MUTATION_FAILED_EVENT,listener);}
});

it('explains a duplicate office code without exposing database or other agency details',()=>{
  const message=apiErrorDetail({isAxiosError:true,response:{data:{detail:'network_office_code_already_exists'}}});
  expect(message).toBe('Ce code est déjà utilisé par un bureau ou un entrepôt de votre réseau. Choisissez un autre code.');
  expect(message).not.toMatch(/organizations|constraint|SQL|network_office/);
  const legacy=apiErrorDetail({isAxiosError:true,response:{data:{detail:'network_office_code_unavailable'}}});
  expect(legacy).toContain('Choisissez un autre code');
  expect(legacy).not.toContain('votre réseau');
});

it.each(['https://untrusted.example/attachment','//untrusted.example/attachment'])('does not send session credentials outside the API: %s',async url=>{
  const token=vi.fn().mockResolvedValue('private-session');
  const adapter=vi.fn();
  setAccessTokenProvider(token);
  await expect(api.get(url,{adapter})).rejects.toThrow('n’est pas autorisée');
  expect(token).not.toHaveBeenCalled();
  expect(adapter).not.toHaveBeenCalled();
});

it('rejects a per-request API base override before retrieving credentials',async()=>{
  const token=vi.fn();setAccessTokenProvider(token);
  await expect(api.get('/clients',{baseURL:'https://untrusted.example'})).rejects.toThrow('n’est pas autorisée');
  expect(token).not.toHaveBeenCalled();
});

it('keeps normal same-API authenticated requests functional',async()=>{
  setAccessTokenProvider(vi.fn().mockResolvedValue('private-session'));
  const adapter=vi.fn(async (config:InternalAxiosRequestConfig)=>({data:{ok:true},status:200,statusText:'OK',headers:{},config}));
  await api.get('/clients',{baseURL:API_BASE_URL,adapter});
  expect(adapter.mock.calls[0][0].headers.Authorization).toBe('Bearer private-session');
});
