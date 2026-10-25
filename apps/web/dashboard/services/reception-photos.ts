import {uploadPackageMedia} from './packages';
export class ReceptionPhotoValidationError extends Error{}

export function receptionPhotos(form:FormData){
 const photos=form.getAll('reception_photos').filter((file):file is File=>file instanceof File&&file.size>0);
 if(photos.length>10)throw new ReceptionPhotoValidationError('Choisissez au maximum 10 photos.');
 if(photos.some(file=>file.size>25*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)))throw new ReceptionPhotoValidationError('Choisissez des photos JPEG, PNG ou WebP de 25 Mo maximum.');
 return photos;
}

export async function uploadReceptionPhotos(packageId:string,photos:File[],share:boolean){
 const failed:string[]=[];
 for(const file of photos){
  try{await uploadPackageMedia(packageId,file,'RECEPTION',undefined,share);}catch{failed.push(file.name);}
 }
 return failed;
}
