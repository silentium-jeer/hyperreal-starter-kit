import { InputLayer, KeyBinding } from '../../shared/input';

export function KitBindings({ toggleEditMode }: { toggleEditMode(): void }) {
  return (
    <InputLayer name="Kit">
      <KeyBinding keys="F8" label="Play / Edit" run={toggleEditMode} />
    </InputLayer>
  );
}
