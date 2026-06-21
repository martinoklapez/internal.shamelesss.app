import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<{ id: string }>
}

/** Legacy /phone-numbers/[id] URLs open the messages modal on the directory page. */
export default async function PhoneNumberDetailRedirect({ params }: PageProps) {
  const { id } = await params
  redirect(`/phone-numbers?phone=${id}`)
}
