import Link from "next/link";

export default function KvkkLegalPage() {
  return (
    <>
      <h1>KVKK aydınlatma metni</h1>
      <p>Bu metin hazırlanıyor. Kişisel verilerinizin işlenmesine ilişkin güncel bilgi için bizimle iletişime geçin.</p>
      <p>
        <Link href="/register" className="text-primary hover:underline">
          Kayıt sayfasına dön
        </Link>
      </p>
    </>
  );
}
