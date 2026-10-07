import CommunityProfile from "@/app/ui/community-profile";
export default async function CommunityMemberPage({params}:{params:Promise<{handle:string}>}){const {handle}=await params;return <CommunityProfile handle={handle}/>}
