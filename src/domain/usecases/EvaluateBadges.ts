import { Transaction } from '../entities/Transaction';
import { Challenge } from '../entities/Challenge';
import { CalculateRegistrationStreak } from './CalculateRegistrationStreak';

export interface BadgeItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  category: 'habit' | 'savings' | 'budget';
  unlocked: boolean;
  unlockedDate?: string;
  color: string;
}

export class EvaluateBadges {
  static execute(
    userTxs: Transaction[],
    challenge: Challenge | null
  ): BadgeItem[] {
    
    // 1. Constancia de Acero (Racha de 7 días)
    const dates = userTxs.map(tx => tx.transactionDate);
    const todayStr = new Date().toISOString().split('T')[0];
    const streak = new CalculateRegistrationStreak().execute(dates, todayStr);
    const constanciaUnlocked = streak >= 7;

    // 2. Constructor de Capital (Aporte a Inversión o Ahorro)
    const constructorUnlocked = userTxs.some(tx => 
      tx.type === 'expense' && 
      (tx.note?.toLowerCase().includes('ahorro') || tx.note?.toLowerCase().includes('inversion') || tx.note?.toLowerCase().includes('inversión'))
    );

    // 3. Mente Realista (Presupuesto ajustado)
    const menteUnlocked = userTxs.length >= 20;

    // 4. Escudo Fugas Hormiga (Control de gastos menores)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentTxs = userTxs.filter(tx => new Date(tx.transactionDate) >= sevenDaysAgo && tx.type === 'expense');
    const hormigas = recentTxs.filter(tx => tx.amount < 20000);
    const escudoUnlocked = recentTxs.length > 0 && hormigas.length <= 2; // Activo pero controlado

    return [
      {
        id: 'badge-streak-7d',
        title: 'Constancia de Acero',
        subtitle: '7 días seguidos registrando movimientos',
        icon: 'fire',
        category: 'habit',
        unlocked: constanciaUnlocked,
        unlockedDate: constanciaUnlocked ? new Date().toISOString().split('T')[0] : 'Reto Activo',
        color: '#F97316',
      },
      {
        id: 'badge-investment',
        title: 'Constructor de Capital',
        subtitle: 'Primer aporte a Inversión o Ahorro activo',
        icon: 'rocket-launch',
        category: 'savings',
        unlocked: constructorUnlocked,
        unlockedDate: constructorUnlocked ? 'Desbloqueado' : undefined,
        color: '#059669',
      },
      {
        id: 'badge-realistic-budget',
        title: 'Mente Realista',
        subtitle: 'Adaptaste una meta con Sugerencia Inteligente',
        icon: 'lightning-bolt',
        category: 'budget',
        unlocked: menteUnlocked,
        unlockedDate: menteUnlocked ? 'Desbloqueado' : undefined,
        color: '#2563EB',
      },
      {
        id: 'badge-frugal-7d',
        title: 'Escudo Fugas Hormiga',
        subtitle: '7 días con gastos de antojitos bajo control',
        icon: 'shield-check',
        category: 'savings',
        unlocked: escudoUnlocked,
        unlockedDate: escudoUnlocked ? 'Desbloqueado' : undefined,
        color: '#8B5CF6',
      },
      {
        id: 'badge-family-team',
        title: 'Familia Implacable',
        subtitle: 'Semana con 100% de registros en equipo',
        icon: 'account-group',
        category: 'habit',
        unlocked: false, // Requiere `allTxs`, lo saltamos por simplicidad
        color: '#EC4899',
      },
      {
        id: 'badge-clean-month',
        title: 'Cierre de Mes Dorado',
        subtitle: 'Mantuviste las Necesidades dentro del 50%',
        icon: 'crown',
        category: 'budget',
        unlocked: false, // Requiere cálculos de FinancialHealth
        color: '#EAB308',
      },
    ];
  }
}
