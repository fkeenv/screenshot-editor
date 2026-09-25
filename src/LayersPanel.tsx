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
import { useRef, useState } from "react";
import type { Layer } from "./editor";

export type LayerActions = {
  select: (layerId: string) => void;
  reorder: (layerId: string, targetIndex: number) => void;
  rename: (layerId: string, name: string) => void;
  setVisibility: (layerId: string, visible: boolean) => void;
  previewOpacity: (layerId: string, opacity: number) => void;
  commitOpacity: (layerId: string, previousOpacity: number) => void;
};

type LayersPanelProps = {
  layers: Layer[];
  selectedLayerId?: string;
  actions: LayerActions;
};

type LayerRowProps = Omit<LayersPanelProps, "layers"> & {
  layer: Layer;
  index: number;
  layerCount: number;
  onDragStart: (layerId: string) => void;
  onDragEnd: () => void;
};

function LayerRow({
  layer,
  index,
  layerCount,
  selectedLayerId,
  actions,
  onDragStart,
  onDragEnd,
}: LayerRowProps) {
  const opacityStart = useRef<number | undefined>(undefined);

  function beginOpacityChange() {
    opacityStart.current ??= layer.opacity;
  }

  function finishOpacityChange() {
    const previousOpacity = opacityStart.current;
    opacityStart.current = undefined;
    if (previousOpacity !== undefined) {
      actions.commitOpacity(layer.id, previousOpacity);
    }
  }

  return (
    <Paper
      withBorder
      p="xs"
      radius="sm"
      bg={selectedLayerId === layer.id ? "dark.6" : "dark.7"}
      style={{
        borderColor:
          selectedLayerId === layer.id
            ? "var(--mantine-primary-color-filled)"
            : undefined,
      }}
      onClick={() => actions.select(layer.id)}
    >
      <Stack gap={8}>
        <Group gap={6} wrap="nowrap">
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
          <TextInput
            key={`${layer.id}-${layer.name}`}
            defaultValue={layer.name}
            aria-label={`Name for ${layer.name}`}
            size="xs"
            style={{ flex: 1 }}
            onFocus={() => actions.select(layer.id)}
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
          <Badge variant="light" color="gray" size="xs">
            {layer.kind}
          </Badge>
        </Group>

        <Group gap={6} wrap="nowrap">
          <ActionIcon
            variant="default"
            size="sm"
            aria-label={`Move ${layer.name} up`}
            title="Move layer up"
            disabled={index === layerCount - 1}
            onClick={(event) => {
              event.stopPropagation();
              actions.reorder(layer.id, index + 1);
            }}
          >
            ↑
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="sm"
            aria-label={`Move ${layer.name} down`}
            title="Move layer down"
            disabled={index === 0}
            onClick={(event) => {
              event.stopPropagation();
              actions.reorder(layer.id, index - 1);
            }}
          >
            ↓
          </ActionIcon>
          <Text c="dimmed" size="xs">
            Opacity
          </Text>
          <Box
            style={{ flex: 1 }}
            onPointerDownCapture={beginOpacityChange}
            onKeyDownCapture={beginOpacityChange}
            onBlurCapture={finishOpacityChange}
          >
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={layer.opacity}
              label={(value) => `${Math.round(value * 100)}%`}
              aria-label={`Opacity for ${layer.name}`}
              size="xs"
              onClick={(event) => event.stopPropagation()}
              onChange={(opacity) => actions.previewOpacity(layer.id, opacity)}
              onChangeEnd={finishOpacityChange}
            />
          </Box>
          <Text size="xs" ta="right" w={34}>
            {Math.round(layer.opacity * 100)}%
          </Text>
        </Group>
      </Stack>
    </Paper>
  );
}

export function LayersPanel({
  layers,
  selectedLayerId,
  actions,
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
      w={{ base: 220, sm: 280 }}
      miw={{ base: 220, sm: 280 }}
      bg="dark.8"
      style={{
        display: "flex",
        flex: "0 0 auto",
        flexDirection: "column",
        overflow: "hidden",
        borderLeft: "1px solid var(--mantine-color-dark-4)",
      }}
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
          Add an image or text to get started.
        </Text>
      ) : (
        <ScrollArea type="auto" style={{ flex: 1 }}>
          <Stack gap={0} py="xs" role="list" aria-label="Layer stack">
            {displayLayers.map((layer, displayIndex) => {
              const index = layers.length - displayIndex - 1;
              return (
                <Box key={layer.id}>
                  {dropTarget(displayIndex)}
                  <Box role="listitem" px="xs">
                    <LayerRow
                      layer={layer}
                      index={index}
                      layerCount={layers.length}
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
