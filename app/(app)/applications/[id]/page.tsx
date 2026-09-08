import { ApplicationThread } from '@/components/application-thread';

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationThread applicationId={id} />;
}
