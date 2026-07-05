import { AdminSectionView } from '@/components/admin/AdminSectionView'
import { getRequestContext } from '@/server/context/request-context'
import { requireAdminManage } from '@/server/security/module-guard'

export default async function Page() {
  const context = await getRequestContext()
  if (context) requireAdminManage(context)
  return <AdminSectionView sectionKey="api" />
}
