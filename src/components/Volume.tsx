import type { ChangeEventHandler } from "react";

type VolumeProps = {
  defaultVolume: number;
  onVolumeChange: ChangeEventHandler<HTMLInputElement>;
};

export function Volume({ defaultVolume, onVolumeChange }: VolumeProps) {
  return (
    <label>
      Adjust volume
      <input
        type="range"
        min={0}
        max={100}
        defaultValue={defaultVolume?.toString()}
        onChange={onVolumeChange}
      />
    </label>
  );
}
