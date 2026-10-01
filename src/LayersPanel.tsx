import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Paper,
  ScrollArea,
  Slider,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useState } from "react";
import {
  useControlEditLifetime,
  type ControlEdit,
} from "./control-edit";
import type { Layer } from "./editor";

export type LayerActions = {
  select: (layerId: string) => void;
  reorder: (layerId: string, targetIndex: number) => void;
  rename: (layerId: string, name: string) => void;
  setVisibility: (layerId: string, visible: boolean) => void;
  beginOpacityEdit: (layerId: string) => ControlEdit;
};

type LayersPanelProps = {
  layers: Layer[];
  selectedLayerId?: string;
  actions: LayerActions;
  inert?: boolean;
};

type LayerRowProps = Omit<LayersPanelProps, "layers"> & {
  layer: Layer;
  onDragStart: (layerId: string) => void;
  onDragEnd: () => void;
};

function LayerRow({
  layer,
  selectedLayerId,
  actions,
  onDragStart,
  onDragEnd,
}: LayerRowProps) {
  return (
    <Paper
      withBorder
      p={5}
      radius="sm"
      style={{
        background: selectedLayerId === layer.id
          ? "var(--layer-selected)"
          : "var(--layer-surface)",
        borderColor:
          selectedLayerId === layer.id
            ? "var(--accent)"
            : undefined,
      }}
    >
      <Group gap={4} wrap="nowrap">
        <ActionIcon
          variant="subtle"
          color="gray"
          draggable
          aria-label={`Drag ${layer.name} to reorder`}
          title="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", layer.id);
            onDragStart(layer.id);
          }}
          onDragEnd={onDragEnd}
        >
          ⠿
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
          aria-pressed={layer.visible}
          title={layer.visible ? "Hide layer" : "Show layer"}
          onClick={(event) => {
            event.stopPropagation();
            actions.setVisibility(layer.id, !layer.visible);
          }}
        >
          {layer.visible ? "◉" : "○"}
        </ActionIcon>
        <button
          type="button"
          className="layer-select flex flex-1 min-w-0 items-center gap-[5px] py-[4px] px-[5px] bg-transparent border-0 text-left"
          aria-pressed={selectedLayerId === layer.id}
          onClick={() => actions.select(layer.id)}
        >
          <span>{layer.name}</span>
          <span className="layer-kind flex-none text-muted text-[10px] uppercase">{layer.kind}</span>
        </button>
      </Group>
    </Paper>
  );
}

export function SelectedLayerControls({
  layer,
  index,
  layerCount,
  actions,
}: {
  layer: Layer;
  index: number;
  layerCount: number;
  actions: Pick<LayerActions, "rename" | "beginOpacityEdit" | "reorder">;
}) {
  const opacityEdit = useControlEditLifetime(() =>
    actions.beginOpacityEdit(layer.id),
  );

  return (
    <div className="selected-layer-controls grid gap-[14px] mt-[12px]">
      <label>
        Name
        <TextInput
          key={`${layer.id}-${layer.name}`}
          defaultValue={layer.name}
          aria-label={`Name for ${layer.name}`}
          size="xs"
          onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (name && name !== layer.name) {
              actions.rename(layer.id, name);
            } else if (!name) {
              event.currentTarget.value = layer.name;
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
      <div className="layer-order-controls flex items-center justify-between gap-[8px] text-muted text-[12px]">
        <span>Layer order</span>
        <div>
          <ActionIcon
            variant="default"
            aria-label={`Move ${layer.name} up`}
            title="Move layer up"
            disabled={index === layerCount - 1}
            onClick={() => actions.reorder(layer.id, index + 1)}
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="default"
            aria-label={`Move ${layer.name} down`}
            title="Move layer down"
            disabled={index === 0}
            onClick={() => actions.reorder(layer.id, index - 1)}
          >
            ↓
          </ActionIcon>
        </div>
      </div>
      <label>
        <span className="opacity-heading">
          <span>Opacity</span>
          <output>{Math.round(layer.opacity * 100)}%</output>
        </span>
        <Box
          onPointerDownCapture={opacityEdit.pointerDown}
          onPointerCancelCapture={opacityEdit.pointerCancel}
          onKeyDownCapture={(event) => opacityEdit.keyDown(event.key)}
          onKeyUpCapture={(event) => opacityEdit.keyUp(event.key)}
          onBlurCapture={opacityEdit.blur}
        >
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            label={(value) => `${Math.round(value * 100)}%`}
            aria-label={`Opacity for ${layer.name}`}
            size="xs"
            onChange={opacityEdit.preview}
            onChangeEnd={opacityEdit.changeEnd}
          />
        </Box>
      </label>
    </div>
  );
}

export function LayersPanel({
  layers,
  selectedLayerId,
  actions,
  inert,
}: LayersPanelProps) {
  const [draggedLayerId, setDraggedLayerId] = useState<string>();
  const [dropSlot, setDropSlot] = useState<number>();
  const displayLayers = [...layers].reverse();

  function finishDragging() {
    setDraggedLayerId(undefined);
    setDropSlot(undefined);
  }

  function dropLayer(slot: number) {
    if (!draggedLayerId) return;
    const sourceIndex = displayLayers.findIndex(
      (layer) => layer.id === draggedLayerId,
    );
    const draggedLayer = displayLayers[sourceIndex];
    if (!draggedLayer) return finishDragging();

    const reordered = displayLayers.filter(
      (layer) => layer.id !== draggedLayerId,
    );
    const adjustedSlot = slot - (sourceIndex < slot ? 1 : 0);
    const insertionIndex = Math.min(
      Math.max(adjustedSlot, 0),
      reordered.length,
    );
    reordered.splice(insertionIndex, 0, draggedLayer);
    actions.reorder(draggedLayerId, layers.length - insertionIndex - 1);
    finishDragging();
  }

  function dropTarget(slot: number) {
    const active = draggedLayerId !== undefined && dropSlot === slot;
    return (
      <Box
        h={8}
        mx="xs"
        style={{
          borderRadius: 2,
          background: active
            ? "var(--mantine-primary-color-filled)"
            : "transparent",
        }}
        onDragEnter={(event) => {
          if (!draggedLayerId) return;
          event.preventDefault();
          setDropSlot(slot);
        }}
        onDragOver={(event) => {
          if (!draggedLayerId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          event.preventDefault();
          dropLayer(slot);
        }}
      />
    );
  }

  return (
    <Box
      id="layers-panel"
      component="aside"
      aria-label="Layers"
      inert={inert}
      className="layers-panel flex min-h-0 min-w-0 flex-col overflow-hidden bg-panel"
    >
      <Group h={42} px="sm" justify="space-between">
        <Text fw={600} size="sm">
          Layers
        </Text>
        <Badge variant="light" color="gray" size="sm">
          {layers.length}
        </Badge>
      </Group>
      {layers.length === 0 ? (
        <Text c="dimmed" size="xs" px="sm" py="md">
          Add an image, text, or rectangle to get started.
        </Text>
      ) : (
        <ScrollArea type="auto" style={{ flex: 1 }}>
          <Stack gap={0} py="xs" role="list" aria-label="Layer stack">
            {displayLayers.map((layer, displayIndex) => {
              return (
                <Box key={layer.id}>
                  {dropTarget(displayIndex)}
                  <Box role="listitem" px="xs">
                    <LayerRow
                      layer={layer}
                      selectedLayerId={selectedLayerId}
                      actions={actions}
                      onDragStart={setDraggedLayerId}
                      onDragEnd={finishDragging}
                    />
                  </Box>
                </Box>
              );
            })}
            {dropTarget(displayLayers.length)}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
