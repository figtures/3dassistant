import { InviteAcceptScreen } from "@/features/team/invite-accept-screen";

type PageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  return <InviteAcceptScreen token={decodeURIComponent(token)} />;
}
