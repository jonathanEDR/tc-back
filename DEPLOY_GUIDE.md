# Guía de Despliegue en Render.com

## 📋 Pre-requisitos

1. **Cuenta en Render.com** - Regístrate en [render.com](https://render.com)
2. **Repositorio en GitHub** - Tu código debe estar en un repositorio público o privado en GitHub
3. **Base de datos MongoDB** - MongoDB Atlas o cualquier instancia de MongoDB accesible
4. **Clerk configurado** - Para autenticación

## 🔧 Configuración Previa

### 1. Variables de Entorno Requeridas

Tu aplicación necesita las siguientes variables de entorno:

- `NODE_ENV=production`
- `PORT=10000` (Render usa el puerto 10000 por defecto)
- `MONGODB_URI` - URI de conexión a MongoDB Atlas
- `CLERK_SECRET_KEY` - Clave secreta de Clerk
- `CLERK_ISSUER` - URL del issuer de Clerk
- `CORS_ORIGIN` - URL de tu frontend
- `LOG_LEVEL=info` (opcional)

### 2. Preparar MongoDB Atlas

1. Ve a [MongoDB Atlas](https://cloud.mongodb.com)
2. Crea un cluster (si no tienes uno)
3. En "Database Access", crea un usuario para la aplicación
4. En "Network Access", agrega `0.0.0.0/0` para permitir conexiones desde Render
5. Obtén la cadena de conexión (URI) que se ve así:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority
   ```

### 3. Configurar Clerk

1. En tu dashboard de Clerk, ve a "API Keys"
2. Copia el "Secret Key" (necesario para `CLERK_SECRET_KEY`)
3. El `CLERK_ISSUER` debe ser la URL de tu instancia de Clerk

## 🚀 Pasos para Desplegar

### Paso 1: Conectar Repositorio

1. Inicia sesión en [Render](https://render.com)
2. Click en "New +" → "Web Service"
3. Conecta tu cuenta de GitHub si no lo has hecho
4. Selecciona tu repositorio `tc-back`

### Paso 2: Configurar el Servicio

**Configuración Básica:**
- **Name**: `registro-backend` (o el nombre que prefieras)
- **Region**: Elige la región más cercana a tus usuarios
- **Branch**: `main` (o la rama que quieras desplegar)
- **Runtime**: `Docker`
- **Dockerfile Path**: `./Dockerfile`

**Plan:**
- **Instance Type**: `Free` (para empezar)

### Paso 3: Configurar Variables de Entorno

En la sección "Environment Variables", agrega:

```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://tu-usuario:tu-password@cluster.mongodb.net/tu-database?retryWrites=true&w=majority
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxx
CLERK_ISSUER=https://well-marmot-74.clerk.accounts.dev
CORS_ORIGIN=https://tu-frontend.vercel.app
LOG_LEVEL=info
```

> ⚠️ **IMPORTANTE**: Reemplaza los valores de ejemplo con tus valores reales

### Paso 4: Configuraciones Avanzadas (Opcional)

**Auto-Deploy:**
- ✅ Activa "Auto-Deploy" para deployar automáticamente cuando haces push a main

**Health Check:**
- **Health Check Path**: `/`

### Paso 5: Crear el Servicio

1. Click en "Create Web Service"
2. Render comenzará a construir tu aplicación
3. Puedes ver los logs en tiempo real

## 📊 Verificar el Despliegue

### 1. Revisar Logs

- Ve a tu servicio en Render
- Click en "Logs" para ver si hay errores
- Busca el mensaje: `Server listening on port 10000`

### 2. Probar Endpoints

Una vez desplegado, tu API estará disponible en:
```
https://tu-servicio.onrender.com
```

Prueba estos endpoints:
- `GET /` - Debe devolver "Servidor backend activo"
- `GET /api/health` - Si tienes un endpoint de salud
- `GET /api/users` - Para probar la conexión a la BD

### 3. Verificar Base de Datos

Revisa los logs para confirmar:
```
Connected to MongoDB
DB conectada
```

## 🛠️ Solución de Problemas Comunes

### Error: "MONGODB_URI not set in env"

**Solución:** Verifica que hayas configurado la variable `MONGODB_URI` correctamente en Render.

### Error: Connection timeout MongoDB

**Soluciones:**
1. Verifica que hayas añadido `0.0.0.0/0` en Network Access de MongoDB Atlas
2. Confirma que la URI de MongoDB sea correcta
3. Verifica que las credenciales sean válidas

### Error: Clerk authentication failed

**Soluciones:**
1. Verifica que `CLERK_SECRET_KEY` sea correcto
2. Confirma que `CLERK_ISSUER` apunte a tu instancia correcta
3. Asegúrate de que las claves no tengan espacios extra

### Aplicación no responde

**Soluciones:**
1. Verifica que `PORT=10000` esté configurado
2. Revisa los logs para errores de startup
3. Confirma que el Dockerfile se construya correctamente

### CORS errors desde el frontend

**Solución:** Actualiza `CORS_ORIGIN` con la URL exacta de tu frontend.

## 🔄 Actualizaciones y Mantenimiento

### Deploy Manual
- Ve a tu servicio en Render
- Click en "Manual Deploy" → "Deploy latest commit"

### Auto-Deploy
- Si está activado, cada push a `main` desplegará automáticamente

### Ver Logs
- Siempre revisa los logs después de un deploy
- Usa los logs para debug en producción

### Escalabilidad
- Puedes actualizar a un plan pago para mejor rendimiento
- Considera usar un servicio de monitoreo

## 📝 Checklist Final

Antes de considerar el deploy completo:

- [ ] ✅ El servicio se construye sin errores
- [ ] ✅ Los logs muestran "Server listening on port 10000"
- [ ] ✅ Los logs muestran "Connected to MongoDB"
- [ ] ✅ La ruta raíz (`/`) devuelve respuesta
- [ ] ✅ Las rutas de API funcionan correctamente
- [ ] ✅ La autenticación con Clerk funciona
- [ ] ✅ CORS está configurado para tu frontend
- [ ] ✅ Todas las variables de entorno están configuradas

## 🎉 ¡Listo!

Tu backend ya está desplegado en producción. La URL será algo como:
```
https://registro-backend-xxxx.onrender.com
```

Esta URL la usarás para configurar tu frontend para que se conecte a tu API en producción.

---

### Notas Adicionales

1. **Free Plan Limitations**: El plan gratuito de Render "duerme" después de 15 minutos de inactividad
2. **Cold Starts**: El primer request después del "sueño" puede tardar 30-60 segundos
3. **Logs**: Los logs se mantienen por 7 días en el plan gratuito
4. **SSL**: Render proporciona SSL/HTTPS automáticamente

¡Tu aplicación backend ya está lista para recibir requests de tu frontend en producción! 🚀