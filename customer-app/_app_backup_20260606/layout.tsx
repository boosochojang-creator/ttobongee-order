import type { Metadata } from "next";
import { CartProvider } from "./lib/cartStore";

export const metadata: Metadata = {
  title: "또봉이통닭",
  description: "또봉이통닭 주문 앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
