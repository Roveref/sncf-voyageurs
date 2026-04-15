/**
 * SkillsAutocomplete — Shared autocomplete for skills selection
 *
 * Uses the skills catalog from useSkillsCatalogData (React Query facade).
 * freeSolo mode allows entering new skills not in the catalog.
 */

import { memo, useMemo } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { useSkillsCatalogData } from "../../queries/useSkillsCatalogData";

interface SkillsAutocompleteProps {
  value: string[];
  onChange: (skills: string[]) => void;
  label?: string;
  placeholder?: string;
  size?: "small" | "medium";
  disabled?: boolean;
  variant?: "outlined" | "filled" | "standard";
  textFieldSx?: Record<string, any>;
}

interface SkillOption {
  name: string;
  category: string | null;
  usageCount: number;
}

const SkillsAutocomplete = memo(
  ({
    value,
    onChange,
    label = "Skills",
    placeholder = "Add skill...",
    size = "small",
    disabled,
    variant,
    textFieldSx,
  }: SkillsAutocompleteProps) => {
    const catalog = useSkillsCatalogData();

    const options = useMemo(() => {
      // Merge catalog skills with any custom skills already in value
      const catalogNames = new Set(catalog.map((s) => s.name.toLowerCase()));
      const custom: SkillOption[] = value
        .filter((v) => !catalogNames.has(v.toLowerCase()))
        .map((v) => ({ name: v, category: null, usageCount: 0 }));
      // Sort by category so MUI groupBy doesn't produce duplicate headers
      return [...catalog, ...custom].sort((a, b) => {
        const ca = a.category || "Other";
        const cb = b.category || "Other";
        if (ca !== cb) return ca.localeCompare(cb);
        return a.name.localeCompare(b.name);
      });
    }, [catalog, value]);

    return (
      <Autocomplete<SkillOption, true, false, true>
        multiple
        freeSolo
        size={size}
        disabled={disabled}
        options={options}
        value={options.filter((o) => value.some((v) => v.toLowerCase() === o.name.toLowerCase()))}
        getOptionLabel={(opt) => (typeof opt === "string" ? opt : opt.name)}
        groupBy={(opt) => opt.category || "Other"}
        isOptionEqualToValue={(opt, val) => opt.name.toLowerCase() === val.name.toLowerCase()}
        onChange={(_e, newVal) => {
          const skills = newVal.map((v) => (typeof v === "string" ? v : v.name));
          onChange(skills);
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props as any;
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{ display: "flex", justifyContent: "space-between", width: "100%" }}
            >
              <Typography variant="body2">{option.name}</Typography>
              {option.usageCount > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1, flexShrink: 0 }}>
                  {option.usageCount}
                </Typography>
              )}
            </Box>
          );
        }}
        renderTags={(tagValue, getTagProps) =>
          tagValue.map((option, index) => {
            const { key, ...chipProps } = getTagProps({ index });
            return <Chip key={key} label={option.name} size="small" {...chipProps} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label || undefined}
            hiddenLabel={!label}
            placeholder={value.length === 0 ? placeholder : ""}
            variant={variant}
            sx={textFieldSx}
          />
        )}
      />
    );
  }
);
SkillsAutocomplete.displayName = "SkillsAutocomplete";

export default SkillsAutocomplete;
