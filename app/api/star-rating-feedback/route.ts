import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRole } from '@/lib/user-roles'
import { getStarRatingFeedback } from '@/lib/database/star-rating-feedback'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = await getUserRole(user.id)
    if (userRole !== 'admin' && userRole !== 'dev' && userRole !== 'developer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const starRating = searchParams.get('starRating')
    const minRating = searchParams.get('minRating')
    const maxRating = searchParams.get('maxRating')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)

    const result = await getStarRatingFeedback(
      {
        starRating: starRating ? parseInt(starRating, 10) : undefined,
        minRating: minRating ? parseInt(minRating, 10) : undefined,
        maxRating: maxRating ? parseInt(maxRating, 10) : undefined,
      },
      page,
      pageSize
    )

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error in star-rating-feedback route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
