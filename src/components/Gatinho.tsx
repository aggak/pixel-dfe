export type Pose = "cabeca";

const grades: Record<Pose, string[]> = {
  cabeca: [
    "................",
    ".kk..........kk.",
    ".kpk........kpk.",
    ".kppk......kppk.",
    ".kpp#kkkkkk#ppk.",
    "k##############k",
    "k##############k",
    "k##hE######hE##k",
    "k##EE######EE##k",
    "k##############k",
    "kpp####pp####ppk",
    "k#####k##k#####k",
    "k######kk######k",
    ".k############k.",
    "..kkkkkkkkkkkk..",
    "................",
  ],
};

const classes: Record<string, string> = { k: "contorno", "#": "corpo", p: "rosa", E: "olho", h: "brilho" };

function desenhar(grade: string[]) {
  const caminhos: Record<string, string> = {};
  grade.forEach((linha, y) => [...linha].forEach((celula, x) => {
    const classe = classes[celula];
    if (classe) caminhos[classe] = `${caminhos[classe] ?? ""}M${x} ${y}h1v1h-1z`;
  }));
  return { largura: grade[0].length, altura: grade.length, caminhos: Object.entries(caminhos) };
}

const desenhos = Object.fromEntries((Object.keys(grades) as Pose[]).map((pose) => [pose, desenhar(grades[pose])])) as Record<Pose, ReturnType<typeof desenhar>>;

export function Gatinho({ pose = "cabeca", escala = 4, className = "" }: { pose?: Pose; escala?: number; className?: string }) {
  const { largura, altura, caminhos } = desenhos[pose];
  return <svg className={`e-gato e-gato-${pose} ${className}`.trim()} width={largura * escala} height={altura * escala} viewBox={`0 0 ${largura} ${altura}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    {caminhos.map(([classe, d]) => <path key={classe} className={`e-gato-${classe}`} d={d} />)}
  </svg>;
}
