import type { Metadata } from "next";
import { PostForm } from "@/components/post/post-form";
import { SAMPLE_DATA } from "@/lib/listings";

export const metadata: Metadata = {
  title: "Post your property for free | DirectNest",
  description: "List your flat or house for rent or sale in Bengaluru. Free for owners, reviewed by a person, no broker calls.",
};

export default function PostPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-4 pt-8 pb-24 sm:px-6 sm:pt-12">
      <PostForm sample={SAMPLE_DATA} />
    </main>
  );
}
