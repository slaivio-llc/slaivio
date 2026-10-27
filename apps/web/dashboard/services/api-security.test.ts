import { afterEach, expect, it, vi } from 'vitest';
import { api, API_BASE_URL, setAccessTokenProvider } from './api';
import type { InternalAxiosRequestConfig } from 'axios';

afterEach(()=>setAccessTokenProvider(null));

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
