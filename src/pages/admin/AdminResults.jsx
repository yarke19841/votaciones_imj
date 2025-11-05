//import Layout from '../../layouts/Layout.jsx'
//import { Card, CardHeader, Button, Badge } from '../../components/UI'
// TODO: sumar votos por candidato y detectar empates con cupos

export default function AdminResults() {
  const hasTie = true

  return (
    <Layout title="Resultados">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Hombres" caption="Conteo por candidato" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>Carlos Gómez</div>
              <div className="flex items-center gap-2">
                <Badge color="blue">24</Badge>
                <Badge color="green">Dentro</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>Samuel Ríos</div>
              <div className="flex items-center gap-2">
                <Badge color="blue">18</Badge>
                <Badge color="amber">Empate</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Mujeres" caption="Conteo por candidata" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>María López</div>
              <div className="flex items-center gap-2">
                <Badge color="blue">21</Badge>
                <Badge color="green">Dentro</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {hasTie && (
        <Card className="mt-4 flex items-center justify-between">
          <div>
            <div className="font-semibold">Empate detectado</div>
            <div className="text-sm text-gray-600">Se requiere crear Ronda de Desempate para el último cupo.</div>
          </div>
          <Button variant="warning">Crear ronda de desempate</Button>
        </Card>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="secondary">Exportar resultados</Button>
      </div>
    </Layout>
  )
}
