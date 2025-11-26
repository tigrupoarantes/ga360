import { MainLayout } from "@/components/layout/MainLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Admin() {
  const navigate = useNavigate();

  const adminSections = [
    {
      title: 'Áreas e Departamentos',
      description: 'Gerencie a estrutura organizacional da empresa',
      icon: Building2,
      href: '/admin/areas',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Empresas',
      description: 'Gerencie as empresas do Grupo Arantes',
      icon: Building2,
      href: '/admin/empresas',
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
    {
      title: 'Usuários e Permissões',
      description: 'Administre usuários, roles e acessos',
      icon: Users,
      href: '/admin/users',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Configurações Gerais',
      description: 'Ajustes do sistema e preferências',
      icon: Settings,
      href: '/admin/settings',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Administração</h1>
            <p className="text-muted-foreground mt-1">
              Configure e gerencie o sistema
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {adminSections.map((section, index) => (
            <Card
              key={index}
              className="p-6 hover:border-primary/50 transition-all cursor-pointer animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => navigate(section.href)}
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${section.bgColor} mb-4`}>
                <section.icon className={`h-6 w-6 ${section.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {section.title}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {section.description}
              </p>
              <Button variant="ghost" size="sm" className="gap-2">
                Gerenciar
              </Button>
            </Card>
          ))}
        </div>

        <Card className="p-6 bg-muted/30">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Recursos administrativos
          </h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Organize a estrutura da empresa com áreas hierárquicas
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Gerencie usuários e atribua roles específicos para cada perfil
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>
                Configure preferências do sistema e personalize a experiência
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </MainLayout>
  );
}
