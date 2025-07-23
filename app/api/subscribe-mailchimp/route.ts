// app/api/subscribe-mailchimp/route.ts
import siteMetadata from '@/data/siteMetadata'

// --- 关键：指定 Edge Runtime ---
export const runtime = 'edge'
// -------------------------------

// 定义请求体类型
type SubscribeRequestBody = {
  email: string
  // 可以根据需要添加其他字段，如 FNAME, LNAME 等
}

// 定义 Mailchimp API 响应的基本类型 (可以根据实际 API 文档扩展)
type MailchimpMemberResponse = {
  id: string
  email_address: string
  status: string
  // ... 其他字段
}

type MailchimpErrorResponse = {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  // ... 其他错误字段
}

type MailchimpResponse = MailchimpMemberResponse | MailchimpErrorResponse

export async function POST(request: Request) {
  try {
    // 1. 从环境变量获取 Mailchimp 配置
    // 注意：在 Cloudflare Pages 项目设置中配置这些环境变量
    const API_KEY = process.env.MAILCHIMP_API_KEY
    const AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID // 也叫 List ID

    if (!API_KEY || !AUDIENCE_ID) {
      console.error(
        'Missing Mailchimp environment variables (MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID)'
      )
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Mailchimp credentials.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 2. 解析请求体
    let body: SubscribeRequestBody
    try {
      body = await request.json()
    } catch (jsonError: unknown) {
      let jsonErrorMessage = 'Unknown error'
      if (jsonError instanceof Error) {
        jsonErrorMessage = jsonError.message
      }
      console.error('Failed to parse JSON body:', jsonErrorMessage)
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { email } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required.' }), {
        status: 400, // Bad Request
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. 构造 Mailchimp API 请求
    // 从 API Key 中提取数据中心 (例如 us16, us19, etc.)
    const DATACENTER = API_KEY.split('-')[1]
    if (!DATACENTER) {
      console.error('Invalid Mailchimp API Key format.')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Invalid Mailchimp API Key format.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const url = `https://${DATACENTER}.api.mailchimp.com/3.0/lists/${AUDIENCE_ID}/members`

    // 构造请求体
    const mailchimpData = {
      email_address: email,
      status: 'subscribed', // 或 'pending' 如果需要确认邮件
      // merge_fields: { // 如果需要设置名字等字段
      //   FNAME: firstName,
      //   LNAME: lastName
      // }
    }

    // 4. 发送请求到 Mailchimp
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`anystring:${API_KEY}`)}`, // Mailchimp 使用 Basic Auth
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailchimpData),
    })

    let mailchimpResult: MailchimpResponse
    try {
      mailchimpResult = await response.json()
    } catch (parseError: unknown) {
      let parseErrorMessage = 'Unknown error'
      if (parseError instanceof Error) {
        parseErrorMessage = parseError.message
      }
      console.error('Failed to parse Mailchimp response JSON:', parseErrorMessage)
      return new Response(JSON.stringify({ error: 'Failed to process response from Mailchimp.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 5. 处理 Mailchimp 响应
    if (response.ok) {
      // 成功订阅
      console.log(`Successfully subscribed ${email} to Mailchimp list ${AUDIENCE_ID}`)
      return new Response(JSON.stringify({ message: 'Thank you for subscribing!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } else {
      // Mailchimp 返回错误 (如邮箱已存在、无效邮箱等)
      const errorResult = mailchimpResult as MailchimpErrorResponse
      console.error('Mailchimp API error:', errorResult)

      let errorMessage = 'Subscription failed. Please try again later.'
      let statusCode = response.status

      // 根据 Mailchimp 错误类型返回更友好的信息
      if (errorResult?.title === 'Member Exists') {
        errorMessage = 'This email is already subscribed.'
        statusCode = 409 // Conflict
      } else if (errorResult?.title === 'Invalid Resource') {
        // 这通常意味着邮箱格式错误
        errorMessage = 'Please provide a valid email address.'
        statusCode = 400 // Bad Request
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (error: unknown) {
    // 6. 处理网络错误或其他意外错误
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message // 现在可以安全地访问 .message
    }
    console.error('Internal server error during Mailchimp subscription:', errorMessage)
    return new Response(
      JSON.stringify({ error: 'Internal server error. Please try again later.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// 如果需要，也可以实现 GET 方法来获取订阅状态等，但通常 POST 用于订阅
export async function GET() {
  try {
    return new Response(
      JSON.stringify({ message: 'Use POST method to subscribe to the newsletter.' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: unknown) {
    let errorMessage = 'Unknown error'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    console.error('Internal server error in GET handler:', errorMessage)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
