const axios = require('axios');

// Configuración
const BASE_URL = 'https://italicia-imagenes-kommo.un5bby.easypanel.host';

// IMPORTANTE: Reemplaza estos valores con tus credenciales reales
const ACCESS_TOKEN = 'TU_TOKEN_OAUTH2_AQUI';
const DRIVE_URL = 'https://drive-c.kommo.com'; // Cambia según tu región (drive-b, drive-c, drive-e)
const IMAGE_URL = 'https://picsum.photos/800/600'; // URL de imagen de prueba

async function testHealthCheck() {
  console.log('\n🔍 Probando /health...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check OK:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Error en health check:', error.message);
    return false;
  }
}

async function testProcessUrl() {
  console.log('\n📤 Probando /process-url...');
  try {
    const response = await axios.post(`${BASE_URL}/process-url`, {
      image_url: IMAGE_URL,
      drive_url: DRIVE_URL,
      access_token: ACCESS_TOKEN
    });

    console.log('✅ Imagen subida exitosamente!');
    console.log('📁 Archivo:', response.data.file);
    console.log('🔑 File UUID:', response.data.kommo.file_uuid);
    console.log('🔑 Session UUID:', response.data.kommo.session_uuid);
    return response.data;
  } catch (error) {
    console.error('❌ Error al subir imagen:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Datos:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

async function runTests() {
  console.log('🚀 Iniciando pruebas del microservicio...\n');
  console.log('URL Base:', BASE_URL);

  // Verificar configuración
  if (ACCESS_TOKEN === 'TU_TOKEN_OAUTH2_AQUI') {
    console.error('\n⚠️  ADVERTENCIA: Debes configurar ACCESS_TOKEN con tu token real de Kommo');
    console.log('Para obtener el token:');
    console.log('1. Ve a tu cuenta de Kommo');
    console.log('2. Settings > Integrations > OAuth');
    console.log('3. Copia el Access Token\n');
  }

  // Test 1: Health check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log('\n❌ El microservicio no responde. Verifica que esté corriendo.');
    return;
  }

  // Test 2: Process URL (solo si hay token)
  if (ACCESS_TOKEN !== 'TU_TOKEN_OAUTH2_AQUI') {
    await testProcessUrl();
  }

  console.log('\n✨ Pruebas completadas!');
}

runTests();
