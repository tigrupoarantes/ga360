import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminCompanies() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirecionar para a nova página de Estrutura Organizacional
    navigate('/admin/estrutura', { replace: true });
  }, [navigate]);

  return null;
}
