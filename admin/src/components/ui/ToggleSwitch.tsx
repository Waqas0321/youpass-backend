type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  className?: string;
};

export function ToggleSwitch({ checked, onChange, label, hint, className }: ToggleSwitchProps) {
  return (
    <label className={`toggle-switch${className ? ` ${className}` : ''}`}>
      <span className="toggle-switch__copy">
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="toggle-switch__control">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="toggle-switch__track" aria-hidden />
      </span>
    </label>
  );
}
