import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const USERS = [
  {
    email: 'daniel@drgrowth.com',
    password: 'Daniel@123456',
    name: 'Daniel',
    role: 'admin',
  },
  {
    email: 'lucas@drgrowth.com',
    password: 'Lucas@123456',
    name: 'Lucas',
    role: 'comercial',
  },
  {
    email: 'gabriel@drgrowth.com',
    password: 'Gabriel@123456',
    name: 'Gabriel',
    role: 'trafego',
  },
  {
    email: 'thamyris@drgrowth.com',
    password: 'Thamyris@123456',
    name: 'Thamyris',
    role: 'financeiro',
  },
]

async function seed() {
  console.log('Starting seed...')

  for (const user of USERS) {
    try {
      console.log(`Creating user ${user.email}...`)

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role,
        },
      })

      if (authError) {
        console.error(`Error creating auth user ${user.email}:`, authError)
        continue
      }

      console.log(`✓ Auth user created: ${user.email}`)

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: null,
        })

      if (profileError) {
        console.error(`Error creating profile for ${user.email}:`, profileError)
        continue
      }

      console.log(`✓ Profile created: ${user.name} (${user.role})`)
    } catch (error) {
      console.error(`Unexpected error for ${user.email}:`, error)
    }
  }

  console.log('Seed completed!')
  process.exit(0)
}

seed().catch((error) => {
  console.error('Seed failed:', error)
  process.exit(1)
})
