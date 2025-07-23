import { NewsletterAPI } from 'pliny/newsletter'
import siteMetadata from '@/data/siteMetadata'

// --- 关键修改：指定 Edge Runtime ---
export const runtime = 'edge';
// ----------------------------------

// 移除此行或确保它不存在
// export const dynamic = 'force-static' // 这对于 API 路由是不正确的

const handler = NewsletterAPI({
  // @ts-ignore - 如果 siteMetadata.newsletter.provider 类型检查有问题，可以忽略
  provider: siteMetadata.newsletter.provider,
})

export { handler as GET, handler as POST }
