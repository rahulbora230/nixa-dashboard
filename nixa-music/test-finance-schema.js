const pool = require('./src/config/db');

async function checkFinanceSchema() {
  try {
    // Check calculated_revenues table structure
    const calculatedColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'calculated_revenues'
      ORDER BY ordinal_position
    `);
    
    console.log('calculated_revenues columns:');
    calculatedColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    // Check raw_revenues table structure
    const rawColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'raw_revenues'
      ORDER BY ordinal_position
    `);
    
    console.log('\nraw_revenues columns:');
    rawColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    // Check payouts table structure
    const payoutsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payouts'
      ORDER BY ordinal_position
    `);
    
    console.log('\npayouts columns:');
    payoutsColumns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
  } catch (error) {
    console.error('Schema check error:', error);
  } finally {
    await pool.end();
  }
}

checkFinanceSchema();
