import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사내 안내 디스플레이',
};

export default function DisplayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="/display/styles.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
