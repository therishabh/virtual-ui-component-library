# virtualui-lib

Virtual UI React Component Library.

## Installation

```bash
npm install virtualui-lib
```

Requires `react` as a peer dependency.

## Usage

```jsx
import { Button, Card } from "virtualui-lib";

function App() {
  return (
    <Card title="Hello" footer={<Button>Save</Button>}>
      Card content goes here.
    </Card>
  );
}
```

## Components

### Button

| Prop       | Type                                    | Default       | Description              |
| ---------- | --------------------------------------- | ------------- | ------------------------ |
| `children` | `ReactNode`                             | `"Button"`    | Button content           |
| `variant`  | `"primary" \| "secondary" \| "outline"` | `"primary"`   | Visual style             |
| `size`     | `"sm" \| "md" \| "lg"`                  | `"md"`        | Button size              |
| `type`     | `string`                                | `"button"`    | Native button type       |
| `disabled` | `boolean`                               | `false`       | Disables the button      |
| `onClick`  | `function`                              | `() => {}`    | Click handler            |
| `style`    | `object`                                | `{}`          | Extra inline styles      |

Any other props are passed to the underlying `<button>`.

### Card

| Prop       | Type        | Default        | Description                |
| ---------- | ----------- | -------------- | -------------------------- |
| `title`    | `string`    | `"Card Title"` | Card heading               |
| `children` | `ReactNode` | `null`         | Card body                  |
| `footer`   | `ReactNode` | `null`         | Footer content             |
| `elevated` | `boolean`   | `true`         | Adds a box shadow          |
| `padding`  | `string`    | `"16px"`       | Inner padding              |
| `style`    | `object`    | `{}`           | Extra inline styles        |

Any other props are passed to the underlying `<div>`.

## Development

```bash
npm run build
```

## License

ISC
