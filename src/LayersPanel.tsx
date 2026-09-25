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
import { useRef } from "react";
import type { Layer } from "./editor";

type LayersPanelProps = {
  layers: Layer[];
  selectedLayerId?: string;
  onSelect: (layerId: string) => void;
  onReorder: (layerId: string, targetIndex: number) => void;
  onRename: (layerId: string, name: string) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onOpacityPreview: (layerId: string, opacity: number) => void;
  onOpacityCommit: (layerId: string, previousOpacity: number) => void;
};

type LayerRowProps = Omit<LayersPanelProps, "layers"> & {
  layer: Layer;
  index: number;
  layerCount: number;
};

function LayerRow({
  layer,
  index,
  layerCount,
  selectedLayerId,
  onSelect,
  onReorder,
  onRename,
  onVisibilityChange,
  onOpacityPreview,
  onOpacityCommit,
}: LayerRowProps) {
  const opacityStart = useRef<number | undefined>(undefined);

  function beginOpacityChange() {
    opacityStart.current ??= layer.opacity;
  }

  function finishOpacityChange() {
    const previousOpacity = opacityStart.current;
    opacityStart.current = undefined;
    if (previousOpacity !== undefined) {
      onOpacityCommit(layer.id, previousOpacity);
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
      onClick={() => onSelect(layer.id)}
    >
      <Stack gap={8}>
        <Group gap={6} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
            aria-pressed={layer.visible}
            title={layer.visible ? "Hide layer" : "Show layer"}
            onClick={(event) => {
              event.stopPropagation();
              onVisibilityChange(layer.id, !layer.visible);
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
            onFocus={() => onSelect(layer.id)}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name && name !== layer.name) {
                onRename(layer.id, name);
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
              onReorder(layer.id, index + 1);
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
              onReorder(layer.id, index - 1);
            }}
          >
            ↓
          </ActionIcon>
          <Text c="dimmed" size="xs">
            Opacity
          </Text>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            label={(value) => `${Math.round(value * 100)}%`}
            aria-label={`Opacity for ${layer.name}`}
            size="xs"
            style={{ flex: 1 }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={beginOpacityChange}
            onKeyDown={beginOpacityChange}
            onChange={(opacity) => onOpacityPreview(layer.id, opacity)}
            onChangeEnd={finishOpacityChange}
            onBlur={finishOpacityChange}
          />
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
  onSelect,
  onReorder,
  onRename,
  onVisibilityChange,
  onOpacityPreview,
  onOpacityCommit,
}: LayersPanelProps) {
  return (
    <Box
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
          <Stack gap={6} p="xs" role="list" aria-label="Layer stack">
            {[...layers].reverse().map((layer, displayIndex) => {
              const index = layers.length - displayIndex - 1;
              return (
                <Box key={layer.id} role="listitem">
                  <LayerRow
                    layer={layer}
                    index={index}
                    layerCount={layers.length}
                    selectedLayerId={selectedLayerId}
                    onSelect={onSelect}
                    onReorder={onReorder}
                    onRename={onRename}
                    onVisibilityChange={onVisibilityChange}
                    onOpacityPreview={onOpacityPreview}
                    onOpacityCommit={onOpacityCommit}
                  />
                </Box>
              );
            })}
          </Stack>
        </ScrollArea>
      )}
    </Box>
  );
}
