-- Köprü makine bağlantıları: Creality LAN desteği

ALTER TABLE bridge_machine_bindings
  DROP CONSTRAINT IF EXISTS bridge_machine_bindings_vendor_check;

ALTER TABLE bridge_machine_bindings
  ADD CONSTRAINT bridge_machine_bindings_vendor_check
  CHECK (vendor IN ('bambu', 'creality'));
