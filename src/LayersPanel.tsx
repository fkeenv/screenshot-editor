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
};

function LayerRow({
  layer,
  index,
  layerCount,
  selectedLayerId,
  actions,
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
                    actions={actions}
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
