import { Fragment } from "react";

/** Texto con los fragmentos entre **dobles asteriscos** en negrita (los títulos de cada métrica en los textos de ayuda). */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}
