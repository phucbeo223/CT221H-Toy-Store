import type { Metadata } from "next";
import "@/components/toyjoy.css";

export const metadata: Metadata = {
  title: "Toyjoy — Niềm vui nhỏ, thế giới lớn",
  description: "Đồ chơi sáng tạo, an toàn và đầy cảm hứng. Khám phá thế giới tuổi thơ cùng Toyjoy.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
