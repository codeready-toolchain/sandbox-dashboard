import { DeleteInstanceModal } from "./DeleteInstanceModal";

type OpenClawDeleteInstanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  deleting?: boolean;
};

export function OpenClawDeleteInstanceModal({
  isOpen,
  onClose,
  onDelete,
  deleting,
}: OpenClawDeleteInstanceModalProps) {
  return (
    <DeleteInstanceModal
      productName="OpenClaw"
      isOpen={isOpen}
      onClose={onClose}
      onDelete={onDelete}
      deleting={deleting}
    />
  );
}
