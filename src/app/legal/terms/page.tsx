import Link from "next/link";

export default function TermsLegalPage() {
  return (
    <>
      <h1>Kullanım koşulları</h1>
      <p>Bu metin hazırlanıyor. Hizmet koşullarımızın güncel sürümü yakında burada yayımlanacaktır.</p>
      <p>
        <Link href="/register" className="text-primary hover:underline">
          Kayıt sayfasına dön
        </Link>
      </p>
    </>
  );
}
