import { useForm } from "react-hook-form";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";
import {
  showToast,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Form,
  TextField,
} from "@calcom/ui";

import type { FilterSegmentOutput } from "../../lib/types";

type FormValues = {
  name: string;
};

export function RenameSegmentDialog({
  segment,
  onClose,
}: {
  segment: FilterSegmentOutput;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const form = useForm<FormValues>({
    defaultValues: {
      name: segment.name,
    },
  });
  const utils = trpc.useUtils();

  const { mutate: updateSegment, isPending } = trpc.viewer.filterSegments.update.useMutation({
    onSuccess: () => {
      utils.viewer.filterSegments.list.invalidate();
      showToast(t("filter_segment_updated"), "success");
      onClose();
    },
    onError: () => {
      showToast(t("error_updating_filter_segment"), "error");
    },
  });

  const handleSubmit = (data: FormValues) => {
    if (!segment) {
      return;
    }
    updateSegment({
      ...segment,
      name: data.name,
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      <DialogContent>
        <DialogHeader title={t("rename_segment")} />
        <Form form={form} handleSubmit={handleSubmit}>
          <div className="space-y-4">
            <TextField required type="text" label={t("name")} {...form.register("name")} />
            <DialogFooter>
              <Button type="submit" loading={isPending}>
                {t("save")}
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
