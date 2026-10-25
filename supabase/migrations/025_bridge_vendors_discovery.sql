-- Köprü otomatik keşif: Klipper (Moonraker), OctoPrint, PrusaLink

ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check;

ALTER TABLE bridge_machine_bindings
  ADD CONSTRAINT bridge_machine_bindings_vendor_check
  CHECK (vendor IN (
    'bambu', 'creality', 'anycubic', 'elegoo', 'flashforge', 'snapmaker',
    'klipper', 'octoprint', 'prusalink'
  ));

-- Yeniden eşleştirme / DHCP sonrası host güncelleme: kullanıcı + marka + seri ile arama
CREATE INDEX IF NOT EXISTS idx_bridge_bindings_user_vendor_serial
  ON bridge_machine_bindings(user_id, vendor, device_serial);
