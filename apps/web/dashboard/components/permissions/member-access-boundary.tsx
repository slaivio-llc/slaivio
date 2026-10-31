'use client';
import {dashboardText,useDashboardMessages} from '@/components/i18n/dashboard-messages';

import {useEffect,type ReactNode} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {usePermissions} from './permission-provider';
import {canOpenMemberPath,memberLanding} from '@/config/member-access';
import {ErrorState,ForbiddenState,LoadingState} from '@/components/ui/page-state';

export function MemberAccessBoundary({children}:{children:ReactNode}){
  useDashboardMessages();
 const {permissions,loading,available,reload,roleCode}=usePermissions();
 const path=usePathname(),router=useRouter();
 const landing=memberLanding(permissions,roleCode);
 const redirect=available&&!loading&&path==='/app'&&landing&&landing!==path;
 useEffect(()=>{if(redirect&&landing)router.replace(landing);},[redirect,landing,router]);
 if(loading||redirect)return <LoadingState label={dashboardText("Ouverture de votre espace…")}/>;
 if(!available)return <ErrorState title={dashboardText("Vos accès n’ont pas pu être vérifiés")} description={dashboardText("Réessayez avant de poursuivre. Aucun accès supplémentaire n’est ouvert pendant cette vérification.")} retry={()=>void reload()}/>;
 if(!canOpenMemberPath(path,permissions,roleCode))return <ForbiddenState description={dashboardText("Votre rôle ne donne pas accès à cette rubrique. Demandez au responsable de votre agence de vérifier vos autorisations.")}/>;
 return <>{children}</>;
}
