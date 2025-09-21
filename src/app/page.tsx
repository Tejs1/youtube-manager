import { YouTubeDashboard } from "@/app/_components/youtube-dashboard";
import { auth } from "@/server/auth";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
	const session = await auth();
	const signedIn = !!session?.user;
	return (
		<HydrateClient>
			<main className="min-h-screen bg-background text-foreground">
				<YouTubeDashboard signedIn={signedIn} />
			</main>
		</HydrateClient>
	);
}
