// A logo do sistema é GLOBAL (uma só para todos) e mora num caminho fixo do
// bucket público `assets`. Como o path é determinístico e o bucket é público,
// a URL é a mesma para qualquer usuário — não precisamos ler de nenhuma tabela
// para exibi-la. O arquivo no bucket É a fonte da verdade.
export const SYSTEM_LOGO_BUCKET = 'assets'
export const SYSTEM_LOGO_DIR = 'site-logo'
export const SYSTEM_LOGO_FILE = 'logo.jpg'
export const SYSTEM_LOGO_PATH = `${SYSTEM_LOGO_DIR}/${SYSTEM_LOGO_FILE}`
