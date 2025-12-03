import FileUpload from './components/FileUpload';
import  Card from './components/Card'
import './App.css';


function App(): React.JSX.Element {
  return (
    <div className='App'>
            <header style={{textAlign: 'center', padding: '20px'}}>
        <h1>Trading212 Dashboard</h1>
      </header>
      <Card title='Your complete dashboard'>
        {/* everything here becomes children */}
        <p>Connect your trading212 account and bank accounts and get a complete view of your net worth with real time profit/loss analysis.
        </p>
        <p></p>
      </Card>



      <FileUpload />
    </div>
  );
}

export default App;

