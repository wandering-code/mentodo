import { NotesBoard } from '../components/Notes'

export function NotesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.03em]">Apuntes</h1>
      <p className="mb-6 mt-1.5 text-[15px] text-muted">Lo que no es una tarea: instrucciones, referencias, cuentas y contraseñas.</p>
      <NotesBoard />
    </div>
  )
}
