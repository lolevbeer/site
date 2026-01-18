/**
 * Reset user password using Payload local API
 *
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <new-password>
 *
 * Example:
 *   npx tsx scripts/reset-password.ts admin@example.com newpassword123
 */

import 'dotenv/config'
import { getPayload } from 'payload'
import config from '../src/payload.config'

async function resetPassword() {
  const [,, email, newPassword] = process.argv

  // Verify login
  if (email === '--verify') {
    const verifyEmail = newPassword
    const verifyPassword = process.argv[4]
    if (!verifyEmail || !verifyPassword) {
      console.error('Usage: npx tsx scripts/reset-password.ts --verify <email> <password>')
      process.exit(1)
    }
    const payload = await getPayload({ config })
    try {
      const result = await payload.login({
        collection: 'users',
        data: {
          email: verifyEmail,
          password: verifyPassword,
        },
      })
      console.log('Login successful!')
      console.log(`User: ${result.user?.email}`)
      console.log(`Token: ${result.token?.substring(0, 20)}...`)
    } catch (err: any) {
      console.error('Login failed:', err.message)
    }
    process.exit(0)
  }

  // List users option
  if (email === '--list') {
    const payload = await getPayload({ config })
    const users = await payload.find({ collection: 'users', limit: 100 })
    if (users.docs.length === 0) {
      console.log('No users found. Create one with: npx tsx scripts/reset-password.ts --create <email> <password>')
    } else {
      console.log('Users:')
      users.docs.forEach(u => console.log(`  - ${u.email}`))
    }
    process.exit(0)
  }

  // Unlock user
  if (email === '--unlock') {
    const unlockEmail = newPassword
    if (!unlockEmail) {
      console.error('Usage: npx tsx scripts/reset-password.ts --unlock <email>')
      process.exit(1)
    }
    const payload = await getPayload({ config })
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: unlockEmail } },
      limit: 1,
    })
    if (users.docs.length === 0) {
      console.error(`User not found: ${unlockEmail}`)
      process.exit(1)
    }
    const user = users.docs[0]
    console.log(`Before: loginAttempts=${user.loginAttempts}, lockUntil=${(user as any).lockUntil}`)

    // Directly clear lock fields
    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        lockUntil: null,
        loginAttempts: 0,
      } as any,
    })
    console.log(`After: loginAttempts=${updated.loginAttempts}, lockUntil=${(updated as any).lockUntil}`)
    console.log(`Unlocked user: ${unlockEmail}`)
    process.exit(0)
  }

  // Delete user
  if (email === '--delete') {
    const delEmail = newPassword
    if (!delEmail) {
      console.error('Usage: npx tsx scripts/reset-password.ts --delete <email>')
      process.exit(1)
    }
    const payload = await getPayload({ config })
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: delEmail } },
      limit: 1,
    })
    if (users.docs.length === 0) {
      console.error(`User not found: ${delEmail}`)
      process.exit(1)
    }
    await payload.delete({
      collection: 'users',
      id: users.docs[0].id,
    })
    console.log(`Deleted user: ${delEmail}`)
    process.exit(0)
  }

  // Fix user to admin role
  if (email === '--fix') {
    const fixEmail = newPassword
    if (!fixEmail) {
      console.error('Usage: npx tsx scripts/reset-password.ts --fix <email>')
      process.exit(1)
    }
    const payload = await getPayload({ config })
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: fixEmail } },
      limit: 1,
    })
    if (users.docs.length === 0) {
      console.error(`User not found: ${fixEmail}`)
      process.exit(1)
    }
    await payload.update({
      collection: 'users',
      id: users.docs[0].id,
      data: { roles: ['admin'] },
    })
    console.log(`Updated ${fixEmail} to admin role`)
    process.exit(0)
  }

  // Create user option
  if (email === '--create') {
    const createEmail = newPassword // shifts args
    const createPassword = process.argv[4]
    if (!createEmail || !createPassword) {
      console.error('Usage: npx tsx scripts/reset-password.ts --create <email> <password>')
      process.exit(1)
    }
    if (createPassword.length < 8) {
      console.error('Error: Password must be at least 8 characters')
      process.exit(1)
    }
    const payload = await getPayload({ config })
    const user = await payload.create({
      collection: 'users',
      data: {
        email: createEmail,
        password: createPassword,
        roles: ['admin'],
      },
    })
    console.log(`Created user: ${user.email}`)
    process.exit(0)
  }

  if (!email || !newPassword) {
    console.error('Usage: npx tsx scripts/reset-password.ts <email> <new-password>')
    console.error('       npx tsx scripts/reset-password.ts --list')
    console.error('       npx tsx scripts/reset-password.ts --create <email> <password>')
    process.exit(1)
  }

  if (newPassword.length < 8) {
    console.error('Error: Password must be at least 8 characters')
    process.exit(1)
  }

  console.log(`Resetting password for: ${email}`)

  try {
    const payload = await getPayload({ config })

    // Find user by email
    const users = await payload.find({
      collection: 'users',
      where: {
        email: { equals: email },
      },
      limit: 1,
    })

    if (users.docs.length === 0) {
      console.error(`Error: User not found with email: ${email}`)
      process.exit(1)
    }

    const user = users.docs[0]
    console.log(`Found user: ${user.email} (ID: ${user.id})`)
    console.log(`Current roles: ${JSON.stringify(user.roles)}`)

    // Update password and ensure roles is set
    const updated = await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password: newPassword,
        roles: user.roles?.length ? user.roles : ['admin'],
      },
    })

    console.log(`Updated roles: ${JSON.stringify(updated.roles)}`)
    console.log('Password reset successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error resetting password:', error)
    process.exit(1)
  }
}

resetPassword()
