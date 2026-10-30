import Link from "next/link";

export default function PrivacyLegalPage() {
  return (
    <>
      <h1>Gizlilik politikası</h1>
      <p>Bu metin hazırlanıyor.</p>
      <p>
        <Link href="/" className="text-primary hover:underline">
          Ana sayfa
        </Link>
      </p>
    </>
  );
}
