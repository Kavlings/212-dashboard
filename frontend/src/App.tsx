import FileUpload from './components/FileUpload';
import './App.css';


function App(): React.JSX.Element {
  return (
    <div className='App'>
      <header style={{textAlign: 'center', padding: '20px'}}>
        <h1>Trading212 Dashboard</h1>
      </header>
      
      <FileUpload />
    </div>
  );
}

export default App;

