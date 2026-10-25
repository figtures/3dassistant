/**
 * LAN (OctoPrint) izleme sunucudan müşterinin verdiği adrese istek atar. Çok kiracılı SaaS'ta bu
 * SSRF demektir; yalnızca tek kiracılı self-host kurulumda açıkça etkinleştirilir.
 */
export function isLanMonitoringEnabled(): boolean {
  return process.env.PRINTFLOW_SELF_HOST_LAN === "true";
}

export const LAN_DISABLED_MESSAGE =
  "Yerel ağ bağlantısı desteklenmiyor. Yazıcılarınızı \"Yazıcıları bağla\" ile üretici hesabınızdan ekleyin.";
