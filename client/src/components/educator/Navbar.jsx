import { useContext } from 'react';
import PropTypes from 'prop-types';
import { assets } from '../../assets/assets';
import { Link } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { UserButton, useUser } from '@clerk/clerk-react';

const Navbar = ({ bgColor }) => {

  const { isEducator } = useContext(AppContext);
  const { user } = useUser();

  return isEducator && user && (
    <div className={`flex items-center justify-between px-4 md:px-8 border-b border-gray-500 py-3 ${bgColor || ''}`}>
      <Link to="/">
        <img src={assets.logo} alt="Logo" className="w-28 lg:w-32" />
      </Link>
      <div className="flex items-center gap-5 text-gray-500 relative">
        <p>Hi! {user.fullName || user.firstName || 'Educator'}</p>
        <UserButton />
      </div>
    </div>
  );
};

Navbar.propTypes = {
  bgColor: PropTypes.string,
};

export default Navbar;