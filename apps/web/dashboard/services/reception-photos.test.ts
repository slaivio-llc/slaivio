import {beforeEach,expect,it,vi} from 'vitest';
import {receptionPhotos,uploadReceptionPhotos} from './reception-photos';
import {uploadPackageMedia} from './packages';
vi.mock('./packages',()=>({uploadPackageMedia:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();});
it('rejects invalid files before a parcel is created',()=>{
 const form=new FormData();form.append('reception_photos',new File(['pdf'],'document.pdf',{type:'application/pdf'}));
 expect(()=>receptionPhotos(form)).toThrow('JPEG');
});
it('ignores an empty file input and rejects more than ten photos',()=>{
 const empty=new FormData();empty.append('reception_photos',new File([],''));expect(receptionPhotos(empty)).toEqual([]);
 for(let i=0;i<11;i++)empty.append('reception_photos',new File(['image'],`${i}.png`,{type:'image/png'}));
 expect(()=>receptionPhotos(empty)).toThrow('10 photos');
});
it('shares only explicitly selected reception images without recreating the parcel',async()=>{
 vi.mocked(uploadPackageMedia).mockResolvedValue({} as Awaited<ReturnType<typeof uploadPackageMedia>>);
 const photo=new File(['image'],'colis.png',{type:'image/png'});
 expect(await uploadReceptionPhotos('parcel',[photo],true)).toEqual([]);
 expect(uploadPackageMedia).toHaveBeenCalledWith('parcel',photo,'RECEPTION',undefined,true);
});
it('retains partial success and reports failed uploads without blindly retrying',async()=>{
 vi.mocked(uploadPackageMedia).mockResolvedValueOnce({} as Awaited<ReturnType<typeof uploadPackageMedia>>).mockRejectedValueOnce(new Error('network'));
 const photos=[new File(['image'],'ok.png',{type:'image/png'}),new File(['image'],'uncertain.png',{type:'image/png'})];
 expect(await uploadReceptionPhotos('parcel',photos,false)).toEqual(['uncertain.png']);
 expect(uploadPackageMedia).toHaveBeenCalledTimes(2);
});
