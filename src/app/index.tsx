import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text,
  TextInput, TouchableOpacity,
  View
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get("window").width;
const INITIAL_MORTGAGE = 102888585;
const STORAGE_KEY = '@plan7030_history';

export default function App() {
  const [month, setMonth] = useState('');
  const [mortgagePayment, setMortgagePayment] = useState('');
  const [weddingSavings, setWeddingSavings] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  // Cargar datos de la memoria del iPhone
  const loadHistory = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) {
        setHistory(JSON.parse(jsonValue));
      }
    } catch (error) {
      console.log("Error al cargar datos: ", error);
    }
  };

  // Guardar datos en la memoria del iPhone
  const handleSave = async () => {
    if (!month || !mortgagePayment || !weddingSavings) {
      Alert.alert('¡Un momento!', 'Por favor completa todos los campos.');
      return;
    }
    setLoading(true);
    try {
      const newEntry = {
        id: Date.now().toString(),
        month: month,
        mortgagePayment: parseFloat(mortgagePayment),
        weddingSavings: parseFloat(weddingSavings),
        timestamp: Date.now()
      };
      
      const newHistory = [newEntry, ...history];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
      
      setHistory(newHistory);
      setMonth(''); setMortgagePayment(''); setWeddingSavings('');
      Alert.alert('¡Éxito!', 'Tu aporte mensual fue guardado en tu dispositivo.');
    } catch (e) {
      Alert.alert('Error', 'No se pudieron guardar los datos.');
    }
    setLoading(false);
  };

  // Cálculos
  const totalMortgagePaid = history.reduce((sum, item) => sum + item.mortgagePayment, 0);
  const totalWeddingSaved = history.reduce((sum, item) => sum + item.weddingSavings, 0);
  const mortgageRemaining = Math.max(0, INITIAL_MORTGAGE - totalMortgagePaid);

  // Datos del Gráfico
  const chartData = [
    {
      name: "Pagado",
      amount: totalMortgagePaid,
      color: "#2ecc71",
      legendFontColor: "#7f8c8d",
      legendFontSize: 13
    },
    {
      name: "Deuda",
      amount: mortgageRemaining,
      color: "#e74c3c",
      legendFontColor: "#7f8c8d",
      legendFontSize: 13
    }
  ];

  // Formato Peso Colombiano (COP)
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyRow}>
      <Text style={styles.historyMonth}>{item.month}</Text>
      <View style={styles.historyAmounts}>
        <Text style={styles.historyMortgage}>+{formatCurrency(item.mortgagePayment)}</Text>
        <Text style={styles.historyWedding}>+{formatCurrency(item.weddingSavings)}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        
        <Text style={styles.headerTitle}>Plan 70/30</Text>
        <Text style={styles.headerSubtitle}>Control de Hipoteca y Boda</Text>

        {/* TARJETAS DE DASHBOARD */}
        <View style={styles.dashboard}>
          <View style={[styles.card, styles.mortgageCard]}>
            <Text style={styles.cardLabel}>Deuda Restante</Text>
            <Text style={styles.cardValue}>{formatCurrency(mortgageRemaining)}</Text>
          </View>
          <View style={[styles.card, styles.weddingCard]}>
            <Text style={styles.cardLabel}>Fondo Boda</Text>
            <Text style={styles.cardValue}>{formatCurrency(totalWeddingSaved)}</Text>
          </View>
        </View>

        {/* GRÁFICO CIRCULAR */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Progreso de Hipoteca</Text>
          <PieChart
            data={chartData}
            width={screenWidth - 40}
            height={180}
            chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
            accessor={"amount"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            center={[10, 0]}
            absolute
          />
        </View>

        {/* FORMULARIO DE REGISTRO */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Nuevo Registro</Text>
          <TextInput 
            style={styles.input} placeholder="Mes (Ej. Oct 2026)" 
            value={month} onChangeText={setMonth} placeholderTextColor="#bdc3c7"
          />
          <TextInput 
            style={styles.input} placeholder="Abono Hipoteca ($)" 
            keyboardType="numeric" value={mortgagePayment} onChangeText={setMortgagePayment} placeholderTextColor="#bdc3c7"
          />
          <TextInput 
            style={styles.input} placeholder="Ahorro Boda ($)" 
            keyboardType="numeric" value={weddingSavings} onChangeText={setWeddingSavings} placeholderTextColor="#bdc3c7"
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Guardando...' : 'Guardar Aporte'}</Text>
          </TouchableOpacity>
        </View>

        {/* HISTORIAL */}
        <Text style={styles.sectionTitle}>Historial de Aportes</Text>
        <FlatList 
          data={history}
          keyExtractor={item => item.id}
          renderItem={renderHistoryItem}
          scrollEnabled={false}
        />
        <View style={{height: 40}} /> 

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingHorizontal: 20, paddingTop: 60 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#2c3e50', textAlign: 'center' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 25 },
  dashboard: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  card: { flex: 1, padding: 20, borderRadius: 16, marginHorizontal: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 5 },
  mortgageCard: { backgroundColor: '#e74c3c' },
  weddingCard: { backgroundColor: '#27ae60' },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginBottom: 5 },
  cardValue: { color: '#ffffff', fontSize: 22, fontWeight: 'bold' },
  chartContainer: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#2c3e50', marginBottom: 15 },
  formContainer: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, marginBottom: 25, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  input: { backgroundColor: '#f1f2f6', padding: 15, borderRadius: 10, fontSize: 16, color: '#2c3e50', marginBottom: 12 },
  saveButton: { backgroundColor: '#2980b9', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 18, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  historyMonth: { fontSize: 16, fontWeight: '600', color: '#34495e' },
  historyAmounts: { alignItems: 'flex-end' },
  historyMortgage: { color: '#e74c3c', fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  historyWedding: { color: '#27ae60', fontWeight: 'bold', fontSize: 14 }
});